FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

ARG REACT_APP_API_ORIGIN=
ENV REACT_APP_API_ORIGIN=$REACT_APP_API_ORIGIN

ARG REACT_APP_REQUEST_TIMEOUT_MS=15000
ENV REACT_APP_REQUEST_TIMEOUT_MS=$REACT_APP_REQUEST_TIMEOUT_MS

RUN npm run build

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]