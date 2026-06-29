FROM denoland/deno:alpine-2.1.10

WORKDIR /app

COPY deno.json /app/deno.json
COPY freebuff2api.deno.ts /app/main.ts
COPY constants.ts freebuff.ts server.ts types.ts /app/

ENV FREEBUFF_HOST=0.0.0.0
ENV FREEBUFF_PORT=4528

EXPOSE 4528

USER deno

CMD ["run", "--allow-env", "--allow-net", "/app/main.ts"]
