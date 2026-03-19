using Microsoft.AspNetCore.SignalR;

namespace SmartScript.Api.Hubs;

public class LogHub : Hub
{
    public async Task JoinScriptGroup(string scriptName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, scriptName);
    }

    public async Task LeaveScriptGroup(string scriptName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, scriptName);
    }
}
