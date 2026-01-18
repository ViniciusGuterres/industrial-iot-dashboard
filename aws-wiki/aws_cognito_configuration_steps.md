# Procedimentos Pós-Deploy: Configuração do Amazon Cognito

Este documento detalha os passos manuais obrigatórios após a execução do `cdk deploy` da stack de autenticação (`AuthStack`).

**Objetivo:** Obter credenciais seguras e criar o usuário Administrador para acesso ao Dashboard.

---

## 1. Coleta de Variáveis de Ambiente

Após o deploy, vá ao **AWS Console > CloudFormation > AuthStack > Outputs** (ou olhe o terminal do CDK) e anote os seguintes valores:

- `IndustrialSentinel-UserPoolId`
- `IndustrialSentinel-UserPoolClientId`
- `IndustrialSentinel-IssuerUrl`
- `IndustrialSentinel-CognitoDomain`

---

## 2. Recuperar o Client Secret (Obrigatório)

Por segurança, o CDK não exibe o segredo do cliente no terminal. Você deve recuperá-lo manualmente.

### Opção A: Via AWS Console (Visual)

1. Acesse o serviço **Amazon Cognito**.
2. Clique no User Pool criado (ex: `sentinel-users`).
3. Vá na aba **App integration**.
4. Role até o fim em **App client list** e clique em `NextJsClient`.
5. Em **App client information**, clique no botão **Show client secret**.
6. Copie o valor.

### Opção B: Via AWS CLI (Rápido)

Execute no terminal:

```bash
aws cognito-idp describe-user-pool-client \
    --user-pool-id <SEU_USER_POOL_ID> \
    --client-id <SEU_CLIENT_ID> \
    --query 'UserPoolClient.ClientSecret' \
    --output text
```
