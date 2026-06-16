FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_ASYNC_APP_NAME
ARG VITE_ASYNC_SUPPORT_EMAIL

ENV VITE_ASYNC_APP_NAME=$VITE_ASYNC_APP_NAME
ENV VITE_ASYNC_SUPPORT_EMAIL=$VITE_ASYNC_SUPPORT_EMAIL

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
