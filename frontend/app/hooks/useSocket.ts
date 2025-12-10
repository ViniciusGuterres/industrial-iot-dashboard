import { useEffect, useState } from "react";
import { io, Socket } from 'socket.io-client';

interface Incident {
    id: number;
    machineId: string;
    description: string;
    severity: string;
    createAt: string;
}

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useSocket() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socketInstance = io(NEXT_PUBLIC_API_URL);

        socketInstance.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to WebSocket...');
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from WebSocket...');
        });

        socketInstance.on('newIncident', (incident: Incident) => {
            setIncidents(prev => [incident, ...prev.slice(0, 19)]);
        });

        socketInstance.on('incidentsList', (incidentList: Incident[]) => {
            setIncidents(incidentList.slice(0, 20));
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };

    }, []);

    return { socket, incidents, isConnected };
}