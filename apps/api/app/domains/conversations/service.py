"""Caixa de entrada: inbox, thread, broker replies, take over from the bot, inbound messages.

Outbound delivery (WhatsApp through Evolution, Instagram) is CRM-2: a broker reply is stored as
`queued` with an idempotency key and the delivery worker sends it. A "SAIR" from the contact
revokes consent on that channel at once.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.time import utcnow
from app.domains.activity.models import EventActor, KeyEventKind
from app.domains.activity.service import emit
from app.domains.contacts import service as contacts
from app.domains.contacts.consent import is_opt_out
from app.domains.contacts.models import Channel, Person
from app.domains.conversations.models import (
    AiMode,
    Author,
    Conversation,
    ConversationChannel,
    Direction,
    Message,
    MessageStatus,
)

# Free-form replies are allowed for this long after the contact's last message (WhatsApp and
# Instagram both use 24 h); outside it only approved templates (CRM-2).
SERVICE_WINDOW = timedelta(hours=24)

CHANNEL_CONSENT = {
    ConversationChannel.WHATSAPP: Channel.WHATSAPP,
    ConversationChannel.INSTAGRAM: Channel.INSTAGRAM,
}


class InboxItem(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    person_name: str
    channel: ConversationChannel
    ai_mode: AiMode
    handoff_reason: str | None
    last_message: str | None
    last_message_at: datetime | None
    unread_count: int
    window_open: bool
    is_demo: bool


class MessageOut(BaseModel):
    id: uuid.UUID
    direction: Direction
    author: Author
    body: str
    status: MessageStatus
    sent_at: datetime


class ThreadOut(BaseModel):
    conversation: InboxItem
    messages: list[MessageOut]


class ReplyIn(BaseModel):
    body: str = Field(min_length=1, max_length=4096)
    idempotency_key: str = Field(min_length=8, max_length=120)


class ConversationNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("conversation_not_found", status_code=404)


def window_open(conversation: Conversation, now: datetime | None = None) -> bool:
    if conversation.channel == ConversationChannel.PAGE:
        return False  # a form is not a chat: answer on WhatsApp, Instagram or email
    last = conversation.last_inbound_at
    return last is not None and (now or utcnow()) - last <= SERVICE_WINDOW


async def _item(session: AsyncSession, c: Conversation, name: str, is_demo: bool) -> InboxItem:
    last = await session.scalar(
        select(Message.body)
        .where(Message.conversation_id == c.id)
        .order_by(Message.sent_at.desc())
        .limit(1)
    )
    return InboxItem(
        id=c.id,
        person_id=c.person_id,
        person_name=name,
        channel=c.channel,
        ai_mode=c.ai_mode,
        handoff_reason=c.handoff_reason,
        last_message=last,
        last_message_at=c.last_message_at,
        unread_count=c.unread_count,
        window_open=window_open(c),
        is_demo=is_demo,
    )


async def inbox(session: AsyncSession, *, needs_you: bool = False) -> list[InboxItem]:
    query = (
        select(Conversation, Person.name, Person.is_demo)
        .join(Person, Person.id == Conversation.person_id)
        .order_by(Conversation.last_message_at.desc().nulls_last())
        .limit(200)
    )
    if needs_you:
        query = query.where(Conversation.ai_mode == AiMode.HANDED_OFF)
    rows = (await session.execute(query)).all()
    return [await _item(session, c, name, demo) for c, name, demo in rows]


async def thread(session: AsyncSession, conversation_id: uuid.UUID) -> ThreadOut:
    row = (
        await session.execute(
            select(Conversation, Person.name, Person.is_demo)
            .join(Person, Person.id == Conversation.person_id)
            .where(Conversation.id == conversation_id)
        )
    ).first()
    if row is None:
        raise ConversationNotFound
    c, name, demo = row
    c.unread_count = 0
    messages = (
        await session.scalars(
            select(Message).where(Message.conversation_id == c.id).order_by(Message.sent_at)
        )
    ).all()
    await session.flush()
    return ThreadOut(
        conversation=await _item(session, c, name, demo),
        messages=[
            MessageOut(
                id=m.id,
                direction=m.direction,
                author=m.author,
                body=m.body,
                status=m.status,
                sent_at=m.sent_at,
            )
            for m in messages
        ],
    )


async def get_or_open(
    session: AsyncSession,
    person: Person,
    channel: ConversationChannel,
    *,
    lead_id: uuid.UUID | None = None,
) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.person_id == person.id, Conversation.channel == channel
        )
    )
    if conversation is None:
        conversation = Conversation(
            person_id=person.id,
            lead_id=lead_id,
            channel=channel,
            ai_mode=AiMode.PAUSED,
            is_demo=person.is_demo,
        )
        session.add(conversation)
        await session.flush()
    return conversation


async def reply(
    session: AsyncSession, conversation_id: uuid.UUID, data: ReplyIn, user_id: uuid.UUID
) -> MessageOut:
    """The broker answers. Free text only inside the service window; a reply takes over."""
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationNotFound
    existing = await session.scalar(
        select(Message).where(Message.idempotency_key == data.idempotency_key)
    )
    if existing is None:
        if not window_open(conversation):
            raise AppError("reply_window_closed", status_code=409)
        now = utcnow()
        existing = Message(
            conversation_id=conversation.id,
            direction=Direction.OUTBOUND,
            author=Author.BROKER,
            author_user_id=user_id,
            body=data.body,
            status=MessageStatus.QUEUED,
            idempotency_key=data.idempotency_key,
            sent_at=now,
        )
        session.add(existing)
        conversation.last_message_at = now
        conversation.ai_mode = AiMode.PAUSED  # a human answered: the bot stops here
        person = await session.get(Person, conversation.person_id)
        if person is not None:
            person.last_interaction_at = now
        emit(
            session,
            KeyEventKind.CONTACT_REPLIED,
            EventActor.BROKER,
            "conversation",
            conversation.id,
            user_id=user_id,
            person_id=conversation.person_id,
        )
        await session.flush()
    return MessageOut(
        id=existing.id,
        direction=existing.direction,
        author=existing.author,
        body=existing.body,
        status=existing.status,
        sent_at=existing.sent_at,
    )


async def take_over(session: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID) -> None:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationNotFound
    conversation.ai_mode = AiMode.PAUSED
    conversation.assigned_user_id = user_id
    await session.flush()


async def record_inbound(
    session: AsyncSession,
    conversation: Conversation,
    body: str,
    *,
    external_id: str | None = None,
    at: datetime | None = None,
) -> Message:
    """A message from the contact (webhook or form). SAIR revokes consent on the channel."""
    now = at or utcnow()
    message = Message(
        conversation_id=conversation.id,
        direction=Direction.INBOUND,
        author=Author.CONTACT,
        body=body,
        status=MessageStatus.RECEIVED,
        external_id=external_id,
        idempotency_key=f"in:{external_id}" if external_id else None,
        sent_at=now,
    )
    session.add(message)
    conversation.last_message_at = now
    if conversation.channel != ConversationChannel.PAGE:
        conversation.last_inbound_at = now
    conversation.unread_count += 1
    person = await session.get(Person, conversation.person_id)
    if person is not None:
        person.last_interaction_at = now
        channel = CHANNEL_CONSENT.get(conversation.channel)
        if channel is not None and is_opt_out(body):
            await contacts.opt_out(session, person, channel, f"conversation:{conversation.id}")
    await session.flush()
    return message
