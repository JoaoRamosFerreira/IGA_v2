Deno.serve(async () => {
  return Response.json({ success: true, message: 'Scheduler watchdog heartbeat OK.' });
});
