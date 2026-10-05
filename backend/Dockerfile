FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV INTERNAL_HOST=127.0.0.1

EXPOSE 3000

CMD ["node", "start-all.js"]
