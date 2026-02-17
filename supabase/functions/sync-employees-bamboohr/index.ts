Deno.serve(async () => {
  return Response.json({ success: true, message: 'BambooHR sync scaffold ready with manual override support.' });
});
