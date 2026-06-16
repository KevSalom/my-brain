# --- Etapa 1: Compilación (Build) ---
FROM node:20-alpine AS build-stage

WORKDIR /app

# Instalar pnpm globalmente en el contenedor
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar el código fuente del frontend
COPY . .

# Recibir la URL del API como argumento de construcción e inyectarla
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Compilar el frontend a producción (genera la carpeta /app/dist)
RUN pnpm run build

# --- Etapa 2: Servidor de Producción (Nginx) ---
FROM nginx:stable-alpine AS production-stage

# Copiar los archivos compilados de la etapa anterior a la carpeta de Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copiar una configuración personalizada de Nginx para manejar rutas de React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
