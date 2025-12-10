Industrial Sentinel: PoC de Monitoramento IoT (Contexto do Projeto)
1. Visão Geral do Projeto
Objetivo: Prova de Conceito (PoC) para simular um sistema em uma empresa montadora de carros brasileira. O sistema simula um ambiente de monitoramento industrial crítico, coletando telemetria de máquinas, detectando anomalias em tempo real e visualizando dados. Prazo: MVP deve estar operante em 48 horas. Requisito Chave: Demonstrar proficiência em Node-RED, Docker, Shell Scripting e Grafana, integrados a uma stack NestJS/Next.js.

2. Arquitetura de Alto Nível
O sistema opera em uma arquitetura de microsserviços containerizada (Docker Compose).

Fluxo de Dados
Geração (Edge): O Node-RED simula sensores industriais enviando dados via HTTP POST.

Ingestão (Backend): A API NestJS recebe o payload, valida, verifica regras de negócio (alertas) e persiste.

Armazenamento: PostgreSQL guarda séries temporais de telemetria e logs de incidentes.

Visualização Operacional: Next.js exibe alertas e status das máquinas para o operador.

Visualização Analítica: Grafana conecta diretamente ao banco para gráficos de performance (Série Temporal).

3. Definição dos Serviços (Stack & Responsabilidades)
A. Edge Layer (Node-RED)
Container Name: sentinel-edge

Porta Externa: 1880

Função: Simular hardware.

Lógica:

Gerar dados a cada 5 segundos.

Simular máquinas: ROBOT_ARM_01, PRESSA_HIDRAULICA_02.

Variar temperatura (80°C - 100°C) e vibração.

Enviar payload JSON para http://backend:3000/telemetry.

B. Backend Layer (NestJS)
Container Name: sentinel-api

Porta Externa: 3001 (Interna: 3000)

Endpoints Chave:

POST /telemetry: Recebe dados do sensor.

GET /incidents: Retorna lista de alertas gerados.

Regra de Negócio Crítica (Business Logic):

Se temperature > 90°C -> Criar registro na tabela incidents com severidade CRITICAL.

Se vibration > 80 -> Criar registro na tabela incidents com severidade WARNING.

 ORM: Prisma (Implementado)

 Implementação Atual:
 - Service/Controller/DTO architecture pattern
 - CreateTelemetryDto com validação (class-validator)
 - Validação de sensorType: apenas 'temperature' ou 'vibration' aceitos
 - TelemetryService usa transações Prisma para atomicidade
 - Retorna dados de telemetria criados
 - Error handling com BadRequestException
 - Global ValidationPipe habilitado

C. Data Layer (PostgreSQL)
Container Name: sentinel-db

Porta Externa: 5432

Database: sentinel_metrics

Esquema Proposto:

Telemetry (id, machineId, sensorType, value, timestamp)

Incident (id, machineId, description, severity, createdAt)

D. Frontend Layer (Next.js)
Container Name: sentinel-dash

Porta Externa: 3000

Função: Dashboard do Operador.

UI: Server Components para listagem de incidentes, Client Components para updates via polling ou SWR.

E. Analytics Layer (Grafana)
Container Name: sentinel-grafana

Porta Externa: 3002

Função: Dashboards complexos.

Setup: Datasource configurado via provisionamento (YAML) apontando para o Postgres.

F. DevOps & Automation
Shell Scripting: Scripts obrigatórios em ./scripts/ para healthcheck e setup de ambiente.

4. Estrutura de Diretórios (Monorepo)

industrial-sentinel/
├── backend/            # NestJS Application
│   ├── src/
│   ├── Dockerfile
│   └── .env
├── frontend/           # Next.js Application
│   ├── src/
│   ├── Dockerfile
│   └── .env.local
├── edge/               # Node-RED Persistent Data
│   └── data/           # Flows.json
├── scripts/            # Shell Scripts (Requisito)
│   ├── healthcheck.sh
│   └── init-db.sh
├── docker-compose.yml  # Orquestração
└── ARCHITECTURE.md     # Este arquivo

5. Convenções de Docker Networking
Network: industrial-net (Bridge)

Comunicação Interna:

Node-RED chama API via: http://backend:3000

Backend chama DB via: postgres://...:5432

Grafana chama DB via: sentinel-db:5432

Frontend (SSR) chama API via: http://backend:3000

Frontend (Browser) chama API via: http://localhost:3001 (Cuidado com CORS/Proxies)


Recommended order:
1. backend/ - Set up NestJS + Prisma, define schemas, create endpoints
2. docker-compose.yml - Get PostgreSQL running so you can test the backend
3. edge/ - Configure Node-RED flows to send data to your working API
4. frontend/ - Build the dashboard once you have real data flowing
5. scripts/ - Add automation scripts last
6. Grafana - Configure dashboards after data is being persisted

Start by creating the backend structure with:
- Prisma schema (Telemetry + Incident models)
- /telemetry POST endpoint
- /incidents GET endpoint
- Temperature > 90°C business logic

 - Dockerfile criado para containerização
  
 **Edge Layer (Node-RED):**
 - Container rodando (sentinel-edge) na porta 1880
 - Flow completo implementado em edge/flows.json
 - Inject nodes configurados para disparar a cada 5s
 - Function nodes gerando dados aleatórios:
   - ROBOT_ARM_01: temperature (80-100°C), vibration (60-100)
   - PRESSA_HIDRAULICA_02: temperature (80-100°C), vibration (60-100)
 - HTTP POST para http://backend:3000/telemetry
 - Debug node para monitorar respostas da API
 - Fluxo de dados completo: Edge → Backend → Database


---

## STATUS DE IMPLEMENTAÇÃO (Atualizado: 2025-12-09)

### ✅ CONCLUÍDO

**Backend (NestJS):**
- Prisma schema com tabelas: machines, telemetry, incidents
- Modular architecture: telemetry/ e incidents/ modules
- POST /telemetry com validação de DTO (class-validator)
- GET /incidents retornando alertas ordenados por data
- Transações Prisma para atomicidade
- Validação de sensorType: apenas 'temperature' ou 'vibration'
- Business logic: temperature > 90°C = CRITICAL, vibration > 80 = WARNING
- Error handling com BadRequestException
- Global ValidationPipe habilitado
- Database rodando em Docker (porta 5433)
- Dockerfile criado para containerização
- Serviço backend containerizado (sentinel-api) na porta 3001

**Edge Layer (Node-RED):**
- Container rodando (sentinel-edge) na porta 1880
- Flow completo implementado em edge/flows.json
- Inject nodes configurados para disparar a cada 5s
- Function nodes gerando dados aleatórios:
  - ROBOT_ARM_01: temperature (80-100°C), vibration (60-100)
  - PRESSA_HIDRAULICA_02: temperature (80-100°C), vibration (60-100)
- HTTP POST para http://backend:3000/telemetry
- Debug node para monitorar respostas da API
- Fluxo de dados completo: Edge → Backend → Database

**Frontend (Next.js):**
- Dashboard operacional em Next.js 14 (App Router)
- Página principal exibindo incidents em tempo real
- Auto-refresh a cada 5 segundos via polling
- UI com Tailwind CSS:
  - Alertas color-coded (vermelho=CRITICAL, amarelo=WARNING)
  - Exibe machineId, description, severity, timestamp
- Client-side component com fetch para /incidents
- Variável de ambiente NEXT_PUBLIC_API_URL configurada
- Dockerfile criado para containerização
- Serviço frontend containerizado (sentinel-dash) na porta 3000

**DevOps & Docker:**
- docker-compose.yml completo com 4 serviços:
  - sentinel-db (PostgreSQL)
  - sentinel-api (Backend NestJS)
  - sentinel-edge (Node-RED)
  - sentinel-dash (Frontend Next.js)
- Network industrial-net conectando todos os serviços
- Volumes persistentes para PostgreSQL
- .dockerignore criado para otimizar builds

### 🚧 PRÓXIMOS PASSOS

**1. Grafana - PRIORIDADE ALTA**
- [ ] Adicionar serviço ao docker-compose
- [ ] Configurar datasource PostgreSQL via provisioning
- [ ] Criar dashboard de séries temporais
- [ ] Gráficos de temperatura e vibração por máquina

**2. DevOps & Scripts - PRIORIDADE MÉDIA**
- [ ] Criar healthcheck.sh para verificar serviços
- [ ] Criar init-db.sh para setup inicial
- [ ] Adicionar health checks nos containers

**3. Melhorias Backend - PRIORIDADE BAIXA**
- [ ] Adicionar endpoint GET /telemetry com filtros
- [ ] Implementar paginação em /incidents
- [ ] Adicionar endpoint GET /machines
- [ ] Seed inicial de máquinas no banco
- [ ] Debouncing de incidents duplicados

**4. Melhorias Frontend - PRIORIDADE BAIXA**
- [ ] Adicionar gráficos de telemetria em tempo real
- [ ] Implementar WebSocket para updates em tempo real
- [ ] Ajustar view
- [ ] Dashboard de status das máquinas
- [ ] Filtros por severidade e máquina