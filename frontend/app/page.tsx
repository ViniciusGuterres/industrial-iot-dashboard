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
        // Limit to last 20 incidents
        setIncidents(data.slice(0, 20));
      } catch (error) {
        console.error('Error fetching incidents:', error);
      }
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL').length;
  const warningCount = incidents.filter(i => i.severity === 'WARNING').length;
  const robotIncidents = incidents.filter(i => i.machineId === 'ROBOT_ARM_01').length;
  const prensaIncidents = incidents.filter(i => i.machineId === 'PRESSA_HIDRAULICA_02').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Industrial Sentinel Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <h3 className="text-red-400 text-sm font-medium">CRITICAL</h3>
            <p className="text-2xl font-bold text-red-300">{criticalCount}</p>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
            <h3 className="text-yellow-400 text-sm font-medium">WARNING</h3>
            <p className="text-2xl font-bold text-yellow-300">{warningCount}</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4">
            <h3 className="text-blue-400 text-sm font-medium">ROBOT ARM</h3>
            <p className="text-2xl font-bold text-blue-300">{robotIncidents}</p>
          </div>
          <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4">
            <h3 className="text-purple-400 text-sm font-medium">PRENSA</h3>
            <p className="text-2xl font-bold text-purple-300">{prensaIncidents}</p>
          </div>
        </div>

        {/* Machine Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              ROBOT_ARM_01
            </h3>
            <p className="text-gray-400">Status: Operacional</p>
            <p className="text-sm text-gray-500">Últimos alertas: {robotIncidents}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              PRESSA_HIDRAULICA_02
            </h3>
            <p className="text-gray-400">Status: Operacional</p>
            <p className="text-sm text-gray-500">Últimos alertas: {prensaIncidents}</p>
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Alertas Recentes</h2>
            <span className="text-sm text-gray-400">Últimos 20 registros</span>
          </div>
          
          {incidents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-400 text-lg">Sistema operando normalmente</p>
              <p className="text-gray-500 text-sm">Nenhum alerta registrado</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`p-4 rounded-lg border-l-4 transition-all hover:bg-gray-700/50 ${
                    incident.severity === 'CRITICAL'
                      ? 'bg-red-900/20 border-red-500'
                      : 'bg-yellow-900/20 border-yellow-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-lg">{incident.machineId}</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            incident.severity === 'CRITICAL'
                              ? 'bg-red-500 text-white'
                              : 'bg-yellow-500 text-black'
                          }`}
                        >
                          {incident.severity}
                        </span>
                      </div>
                      <p className="text-gray-300 mb-2">{incident.description}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(incident.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Industrial Sentinel IoT Dashboard • Atualização automática a cada 5 segundos</p>
        </div>
      </div>
    </div>
  );
}
