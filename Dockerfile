FROM denoland/deno:alpine-2.1.10

WORKDIR /app

COPY freebuff2api.deno.ts /app/main.ts

ENV FREEBUFF_HOST=0.0.0.0
ENV FREEBUFF_PORT=8000

EXPOSE 8000

USER deno

CMD ["run", "--allow-env", "--allow-net", "/app/main.ts"]
