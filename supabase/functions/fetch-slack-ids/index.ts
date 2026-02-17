Deno.serve(async () => {
  return Response.json({ success: true, message: 'Slack ID sync scaffold ready.' });
});
