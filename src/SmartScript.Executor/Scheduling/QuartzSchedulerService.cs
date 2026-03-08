using Microsoft.Extensions.Logging;
using Quartz;
using SmartScript.Core.Interfaces;

namespace SmartScript.Executor.Scheduling;

public class QuartzSchedulerService
{
    private readonly ISchedulerFactory _schedulerFactory;
    private readonly ILogger<QuartzSchedulerService> _logger;

    public QuartzSchedulerService(ISchedulerFactory schedulerFactory, ILogger<QuartzSchedulerService> logger)
    {
        _schedulerFactory = schedulerFactory;
        _logger = logger;
    }

    public async Task ScheduleScriptAsync(IScript script)
    {
        if (string.IsNullOrWhiteSpace(script.Metadata.CronExpression))
            return;

        var scheduler = await _schedulerFactory.GetScheduler();

        var jobKey = new JobKey($"script-{script.Metadata.Name}", "scripts");
        var triggerKey = new TriggerKey($"trigger-{script.Metadata.Name}", "scripts");

        // Remove existing schedule if any
        if (await scheduler.CheckExists(jobKey))
        {
            await scheduler.DeleteJob(jobKey);
            _logger.LogInformation("Removed existing schedule for '{ScriptName}'.", script.Metadata.Name);
        }

        var job = JobBuilder.Create<ScriptJob>()
            .WithIdentity(jobKey)
            .UsingJobData("ScriptName", script.Metadata.Name)
            .Build();

        CronExpression cronExpression;
        try
        {
            cronExpression = new CronExpression(script.Metadata.CronExpression);
        }
        catch (FormatException ex)
        {
            _logger.LogError(
                "Invalid cron expression '{Cron}' for script '{ScriptName}': {Message}. " +
                "Use Quartz.NET cron format (6-7 fields: seconds minutes hours day-of-month month day-of-week [year]).",
                script.Metadata.CronExpression, script.Metadata.Name, ex.Message);
            return;
        }

        var trigger = TriggerBuilder.Create()
            .WithIdentity(triggerKey)
            .WithCronSchedule(script.Metadata.CronExpression)
            .Build();

        await scheduler.ScheduleJob(job, trigger);
        _logger.LogInformation(
            "Scheduled script '{ScriptName}' with cron '{Cron}'. Next fire: {NextFire}.",
            script.Metadata.Name,
            script.Metadata.CronExpression,
            trigger.GetNextFireTimeUtc()?.ToString("u") ?? "N/A");
    }

    public async Task UnscheduleScriptAsync(string scriptName)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var jobKey = new JobKey($"script-{scriptName}", "scripts");

        if (await scheduler.CheckExists(jobKey))
        {
            await scheduler.DeleteJob(jobKey);
            _logger.LogInformation("Unscheduled script '{ScriptName}'.", scriptName);
        }
    }
}
