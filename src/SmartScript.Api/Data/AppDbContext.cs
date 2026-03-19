using Microsoft.EntityFrameworkCore;
using SmartScript.Api.Data.Entities;

namespace SmartScript.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<ScriptRunRecord> ScriptRunRecords => Set<ScriptRunRecord>();
    public DbSet<ScriptSettingEntity> ScriptSettings => Set<ScriptSettingEntity>();
    public DbSet<AiTask> AiTasks => Set<AiTask>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ScriptRunRecord>(e =>
        {
            e.HasKey(r => r.Id);
            e.HasIndex(r => r.ScriptName);
        });

        modelBuilder.Entity<ScriptSettingEntity>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasIndex(s => new { s.ScriptName, s.Key }).IsUnique();
        });

        modelBuilder.Entity<AiTask>(e =>
        {
            e.HasKey(t => t.Id);
            e.HasIndex(t => t.Status);
            e.HasIndex(t => t.CreatedAt);
        });
    }
}
