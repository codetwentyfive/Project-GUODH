'use client';

import React, { useEffect, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function CallScreen() {
  const { state, metrics, endCall } = useCall();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (state.status === 'connected' && state.startTime) {
      interval = setInterval(() => {
        const currentTime = Date.now();
        const startTime = state.startTime?.getTime() ?? currentTime;
        const diff = currentTime - startTime;
        setDuration(Math.floor(diff / 1000));
      }, 1000);
    } else {
      setDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.status, state.startTime]);

  if (state.status === 'idle') return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (state.status) {
      case 'calling':
        return <Badge variant="secondary">Calling...</Badge>;
      case 'connected':
        return <Badge variant="outline">Connected</Badge>;
      case 'reconnecting':
        return <Badge variant="secondary">Reconnecting...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 p-4 w-80 shadow-lg bg-white">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">
              {state.participant?.name || 'Unknown Patient'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge()}
              {state.status === 'connected' && (
                <span className="text-sm text-muted-foreground">
                  {formatDuration(duration)}
                </span>
              )}
            </div>
          </div>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => endCall()}
          >
            End Call
          </Button>
        </div>

        {state.status === 'connected' && metrics && (
          <div className="text-sm space-y-1 text-muted-foreground">
            <div>Packets Lost: {metrics.packetsLost}</div>
            <div>Jitter: {metrics.jitter.toFixed(2)}ms</div>
            <div>Round Trip Time: {metrics.roundTripTime.toFixed(2)}ms</div>
            <div>Audio Level: {(metrics.audioLevel * 100).toFixed(0)}%</div>
          </div>
        )}

        {state.error && (
          <div className="text-sm text-destructive mt-2">
            Error: {state.error}
          </div>
        )}
      </div>
    </Card>
  );
} 