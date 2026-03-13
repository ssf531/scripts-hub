import { useEffect, useRef, useState, useCallback } from "react";
import {
  HubConnectionBuilder,
  HubConnection,
  LogLevel,
} from "@microsoft/signalr";
import type { LogEntry } from "../types";

interface UseLogHubOptions {
  scriptName?: string;
  maxLogs?: number;
}

export function useLogHub({
  scriptName,
  maxLogs = 200,
}: UseLogHubOptions = {}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl("/hubs/log")
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on("ReceiveLog", (entry: LogEntry) => {
      if (!scriptName || entry.scriptName === scriptName) {
        setLogs((prev) => {
          const updated = [...prev, entry];
          return updated.length > maxLogs ? updated.slice(-maxLogs) : updated;
        });
      }
    });

    connection.onreconnected(() => {
      setIsConnected(true);
      setConnectionError(null);
    });
    connection.onclose(() => setIsConnected(false));

    connection
      .start()
      .then(() => {
        setIsConnected(true);
        setConnectionError(null);
      })
      .catch(() => {
        setConnectionError(
          "Live logs unavailable — connection to the server failed. If you are using an ad blocker, try whitelisting this site.",
        );
      });

    return () => {
      connection.stop();
    };
  }, [scriptName, maxLogs]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, clearLogs, isConnected, connectionError };
}
