'use client';

import { useEffect, useState } from 'react';

interface Incident {
  id: number;
  machineId: string;
  description: string;
  severity: string;
  createdAt: string;
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/incidents`);
        const data = await res.json();
        setIncidents(data);
      } catch (error) {
        console.error('Error fetching incidents:', error);
      }
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Industrial Sentinel Dashboard</h1>
      
      <div className="grid gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Alertas Recentes</h2>
          
          {incidents.length === 0 ? (
            <p className="text-gray-400">Nenhum alerta registrado</p>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`p-4 rounded border-l-4 ${
                    incident.severity === 'CRITICAL'
                      ? 'bg-red-900/20 border-red-500'
                      : 'bg-yellow-900/20 border-yellow-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{incident.machineId}</p>
                      <p className="text-sm text-gray-300">{incident.description}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        incident.severity === 'CRITICAL'
                          ? 'bg-red-500'
                          : 'bg-yellow-500 text-black'
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(incident.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
