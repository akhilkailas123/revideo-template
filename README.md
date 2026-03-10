# Revideo Template

The workflow is:

1. Build the Docker services
2. Start the UI to preview the video
3. Modify the video configuration
4. Restart the UI to apply changes
5. Export the final video using the render service

---

# 1. Build Docker Images

Before running anything, build all required Docker images.

```bash
docker compose build --no-cache
```

This builds all services defined in `docker-compose.yml`.

---

# 2. Running Services

## UI Service (Preview Editor)

Run the UI service to preview the generated video.

```bash
docker compose up ui
```

After starting:

UI interface:

```
http://localhost:9000
```

Test media files (for development/testing):

```
http://localhost:3001
```

---

## Render Service (Export Video)

If you want to **render and export the final video**, run:

```bash
docker compose up render
```

The rendered output will be saved in:

```
/output
```

inside the project directory.

---

# 3. Editing Video Configuration

Video content is controlled by the configuration file:

```
src/video.config.json
```

Steps:

1. Start the UI service

```bash
docker compose up ui
```

2. Edit the configuration file

```
src/video.config.json
```

Modify the timeline, assets, or settings as needed.

3. Restart the UI to apply the changes

```bash
docker compose restart ui
```

4. Open the UI again to see the updated video

```
http://localhost:9000
```

---

# 4. Exporting the Final Video

Once the preview looks correct:

Run the render service:

```bash
docker compose up render
```

The rendered video will appear in the:

```
output/
```

directory.

---

# 5. Restart Services

If you make configuration changes and need to refresh the UI:

```bash
docker compose restart ui
```

---

# 6. Stop and Remove Containers

To stop all running services and remove containers, networks, and volumes:

```bash
docker compose down -v
```

---

# 7. Access Container Terminal

To open an interactive terminal inside the `revideo-app` image:

```bash
docker run -it --rm revideo-app bash
```

This allows you to debug, inspect files, or run commands directly inside the container.

# 8. Convert Xml to Json 

```bash 
npm run convert .\sample\sample.xml .\sample\out1.json
```