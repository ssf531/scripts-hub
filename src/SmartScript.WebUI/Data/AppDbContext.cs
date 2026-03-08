using Microsoft.EntityFrameworkCore;
using SmartScript.WebUI.Data.Entities;

namespace SmartScript.WebUI.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<ScriptRunRecord> ScriptRunRecords => Set<ScriptRunRecord>();
    public DbSet<ScriptSettingEntity> ScriptSettings => Set<ScriptSettingEntity>();

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
    }
}
