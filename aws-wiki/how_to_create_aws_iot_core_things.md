# AWS IoT Core - Guia de Provisionamento de Dispositivos (Things)

Este documento descreve o passo a passo para criar e provisionar novos dispositivos (Things) no AWS IoT Core, gerando os certificados necessários para autenticação mTLS (Mutual TLS).

**Pré-requisitos:**

- Conta AWS ativa.
- Acesso ao Console AWS com permissões de Administrador ou IoTFullAccess.

---

## 1. Acessar o Serviço

1. No console da AWS, pesquise por **IoT Core**.
2. No menu lateral esquerdo, vá em **Manage (Gerenciar)** -> **All devices (Todos os dispositivos)** -> **Things (Coisas)**.

## 2. Criar a "Thing" (Identidade do Dispositivo)

1. Clique no botão laranja **Create things**.
2. Selecione a opção **Create single thing** e clique em **Next**.

### Step 1: Thing properties

- **Thing name:** Dê um nome único para o dispositivo (ex: `Sentinel-Edge-Gateway-01`).
- **Device Shadow:** Selecione "No shadow" (para esta arquitetura não utilizaremos Shadows agora).
- Clique em **Next**.

### Step 2: Configure device certificate

- Escolha a opção recomendada: **Auto-generate a new certificate**.
- Clique em **Next**.

### Step 3: Attach policies

_A política define o que esse dispositivo tem permissão para fazer (Publicar, Assinar, Conectar)._

- **Se você já criou a política anteriormente:**
  - Selecione a política existente (ex: `Sentinel-Policy`) na lista.
- **Se for a primeira vez (Criar Política):**
  1. Clique no botão **Create policy** (abrirá uma nova aba).
  2. **Policy name:** Digite `Sentinel-Policy`.
  3. **Policy effect:** Selecione **Allow**.
  4. **Policy action:** Digite `iot:*` (Permissão total para dev/PoC) ou `iot:Connect, iot:Publish, iot:Subscribe` (Para produção).
  5. **Policy resource:** Digite `*`.
  6. Clique em **Create**.
  7. Feche a aba, volte para a tela de criação da Thing e atualize a lista. Selecione a política criada.
- Clique em **Create thing**.

---

## 3. Download dos Certificados (CRÍTICO)

Após clicar em criar, aparecerá uma tela com os links para download. **Esta é a única oportunidade de baixar as chaves privadas.**

Baixe e salve os seguintes arquivos em um local seguro (ex: `./edge/certs/`):

1.  **Device certificate:** Arquivo `.pem.crt` (O crachá público do dispositivo).
2.  **Private key:** Arquivo `.pem.key` (A senha secreta do dispositivo). **NUNCA COMPARTILHE.**
3.  **Amazon Root CA 1:** Arquivo `.pem` (A autoridade certificadora da AWS).
    - _Nota: Se houver opção CA 1 e CA 3, prefira o CA 1._

_O arquivo "Public key" é opcional e raramente usado para configuração do cliente._

Após baixar todos os 3 arquivos, clique em **Done**.

---

## 4. Recuperar o Endpoint (URL de Conexão)

Cada conta AWS tem um endereço único para conexão MQTT. Todos os seus dispositivos usarão o mesmo endereço.

1. No menu lateral esquerdo do IoT Core, role até o final e clique em **Settings (Configurações)**.
2. Copie o valor exibido em **Device data endpoint**.
   - Formato: `xxxxxxxxxxxx-ats.iot.sa-east-1.amazonaws.com`

---

## 5. Configuração no Cliente (Ex: Node-RED)

Para conectar, configure o cliente MQTT (Node-RED, Mosquitto, código Go/Python) com os seguintes parâmetros:

- **Protocolo:** MQTT Seguro (MQTTS)
- **Porta:** `8883`
- **Host:** O Endpoint copiado no passo 4.
- **Certificados (TLS):**
  - Carregar o **Device Certificate**.
  - Carregar a **Private Key**.
  - Carregar o **Root CA**.

---

## Resumo de Arquivos

Ao final, você deve ter na sua pasta de certificados:

- `xxxx-certificate.pem.crt`
- `xxxx-private.pem.key`
- `AmazonRootCA1.pem`
