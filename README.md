# revideo-template

## Build Docker Images

Build all services without using cache:

```bash
docker compose build --no-cache
```

## Run Services

### Run UI Service

```bash
docker compose up ui
```

### Run Render Service

```bash
docker compose up render
```

## Restart Services

```bash
docker compose restart ui
```

## Stop and Remove Containers

Stop all services and remove containers, networks, and volumes:

```bash
docker compose down -v
```

## Access the Application Image Terminal

Run an interactive terminal inside the `revideo-app` image:

```bash
docker run -it --rm revideo-app bash
```
