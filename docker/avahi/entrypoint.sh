#!/bin/bash
# requisito 27: acesso pela rede local via mDNS (previne.local). Precisa rodar com
# network_mode: host no docker-compose para multicast na LAN funcionar.
set -euo pipefail

mkdir -p /var/run/dbus
# pid files sobrevivem num `docker restart` (a camada gravável do container não é limpa, só num
# recreate) - sem isso, depois do primeiro restart o dbus-daemon recusa subir pra sempre com
# "pid file exists", e o `set -e` acima mata o container antes mesmo de tentar publicar o mDNS.
rm -f /var/run/dbus/pid /run/avahi-daemon/pid
dbus-daemon --system --fork
avahi-daemon --daemonize --no-drop-root

IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')
if [ -z "$IP" ]; then
  echo "Não foi possível determinar o IP da máquina para publicar previne.local" >&2
  exit 1
fi

echo "Publicando previne.local -> $IP"
exec avahi-publish -a -R previne.local "$IP"
