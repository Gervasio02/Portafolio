#!/usr/bin/env bash
# Publica una imagen en Azure Container Registry y la despliega en una
# Container App del grupo del portafolio. Si la app aún no existe, la crea en
# el mismo entorno y con el mismo acceso al registro que Snake.
#
# Uso (desde GitHub Actions, tras azure/login):
#   scripts/azure-desplegar-app.sh <app> <contexto> <ruta-salud> <puerto> [VAR=valor ...]
# Variables de entorno requeridas: REGISTRY_NAME, REGISTRY_SERVER.
# Opcionales: AZURE_RESOURCE_GROUP, SECRETOS_ALEATORIOS ("nombre:VARIABLE ...").
set -euo pipefail

app="$1"; contexto="$2"; salud="$3"; puerto="$4"; shift 4
grupo="${AZURE_RESOURCE_GROUP:-rg-portafolio-gervasio}"
nombre="${app}-gervasio-std"
imagen="${REGISTRY_SERVER}/${app}:${GITHUB_SHA}"
referencia="snake-gervasio-std"

az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors >/dev/null
az acr login --name "$REGISTRY_NAME" --only-show-errors
docker build --platform linux/amd64 \
  --label "org.opencontainers.image.source=${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}" \
  --label "org.opencontainers.image.revision=${GITHUB_SHA}" \
  -t "$imagen" "$contexto"
docker push "$imagen"

if ! az containerapp show -n "$nombre" -g "$grupo" --only-show-errors >/dev/null 2>&1; then
  echo "La app $nombre no existe: se crea copiando el entorno de $referencia."
  entorno=$(az containerapp show -n "$referencia" -g "$grupo" --query properties.managedEnvironmentId -o tsv)
  identidad=$(az containerapp show -n "$referencia" -g "$grupo" \
    --query "properties.configuration.registries[0].identity" -o tsv)
  args=(--name "$nombre" --resource-group "$grupo" --environment "$entorno"
    --image "$imagen" --target-port "$puerto" --ingress external
    --registry-server "$REGISTRY_SERVER" --min-replicas 0 --max-replicas 1
    --cpu 0.25 --memory 0.5Gi --only-show-errors)
  if [[ -n "$identidad" && "$identidad" != "None" ]]; then
    args+=(--registry-identity "$identidad")
    if [[ "$identidad" != "system" ]]; then args+=(--user-assigned "$identidad"); fi
  fi
  az containerapp create "${args[@]}"
fi

# Secretos generados aquí mismo: nadie los ve ni los escribe a mano.
referencias=()
for par in ${SECRETOS_ALEATORIOS:-}; do
  secreto="${par%%:*}"; variable="${par##*:}"
  if ! az containerapp secret list -n "$nombre" -g "$grupo" --query "[].name" -o tsv | grep -qx "$secreto"; then
    az containerapp secret set -n "$nombre" -g "$grupo" --only-show-errors \
      --secrets "${secreto}=$(openssl rand -base64 48 | tr -d '\n')" >/dev/null
  fi
  referencias+=("${variable}=secretref:${secreto}")
done

az containerapp update -n "$nombre" -g "$grupo" --only-show-errors \
  --image "$imagen" \
  --revision-suffix "${GITHUB_SHA:0:7}-${GITHUB_RUN_ID}" \
  --min-replicas 0 --max-replicas 1 \
  --set-env-vars "$@" "${referencias[@]}" >/dev/null

fqdn=$(az containerapp show -n "$nombre" -g "$grupo" --query properties.configuration.ingress.fqdn -o tsv)
for intento in {1..30}; do
  if curl --fail --silent --show-error --max-time 10 "https://${fqdn}${salud}" >/dev/null; then
    printf 'Despliegue verificado: https://%s%s\n' "$fqdn" "$salud" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
    exit 0
  fi
  sleep 10
done
echo "La nueva revisión de $nombre no respondió en el tiempo esperado." >&2
exit 1
