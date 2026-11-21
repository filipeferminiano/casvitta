/**
 * Street pages moved to /rua/{cidade}/{bairro}/{rua} (SEO-3). Old URLs answer with a 301 so
 * links and rankings carry over.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ cidade: string; bairro: string; rua: string }> },
) {
  const { cidade, bairro, rua } = await params;
  const target = new URL(`/rua/${cidade}/${bairro}/${rua}`, request.url);
  return Response.redirect(target, 301);
}
