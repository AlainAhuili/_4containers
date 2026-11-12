# Ubuntu 24.04 terminal in the browser (ttyd), with everyday developer tools.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    TERM=xterm-256color

RUN apt-get update && apt-get install -y --no-install-recommends \
        ttyd sudo locales tzdata ca-certificates bash-completion \
        curl wget git vim nano less tree jq zip unzip tmux htop man-db \
        iputils-ping dnsutils net-tools iproute2 openssh-client \
        build-essential python3 python3-pip python3-venv nodejs npm \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# Normal user "dev" with password-less sudo (the container is only reachable from 127.0.0.1).
# Ubuntu 24.04 ships a default "ubuntu" user with UID 1000; remove it so dev gets 1000.
RUN userdel -r ubuntu 2>/dev/null || true \
    && useradd -m -s /bin/bash -u 1000 dev \
    && echo "dev ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/dev \
    && chmod 0440 /etc/sudoers.d/dev \
    && touch /home/dev/.sudo_as_admin_successful \
    && chown dev:dev /home/dev/.sudo_as_admin_successful

COPY --chown=dev:dev motd.sh /etc/profile.d/zz-motd.sh

USER dev
WORKDIR /home/dev
EXPOSE 7681
# -W: writable terminal (ttyd is read-only by default)
CMD ["ttyd", "-W", "-p", "7681", "-t", "titleFixed=Ubuntu Console", "-t", "fontSize=15", "bash", "-l"]
