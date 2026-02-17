Deno.serve(async () => {
  return Response.json({
    success: true,
    jobs: ['sync-employees-bamboohr', 'fetch-slack-ids', 'scheduler-watchdog notifications sweep'],
    message: 'Daily job runner executed scaffold tasks.',
  });
});
