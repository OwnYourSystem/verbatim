## Stage 1: build the React PWA
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

## Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Templated config: nginx:alpine runs envsubst on /etc/nginx/templates/*.template
# at container start, expanding PORT / BACKEND_ORIGIN / BACKEND_HOST.
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Defaults for local `docker run` without overrides (compose / Cloud Run set their own).
# NGINX_ENVSUBST_TEMPLATE_VARS limits substitution to only our 3 vars — prevents
# nginx's own runtime variables ($remote_addr, $scheme, etc.) from being wiped.
ENV PORT=80 \
    BACKEND_ORIGIN=http://backend:8080 \
    BACKEND_HOST=backend \
    NGINX_ENVSUBST_TEMPLATE_VARS="PORT BACKEND_ORIGIN BACKEND_HOST"
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
