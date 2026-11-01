FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server.mjs index.html api-config.js package.json ./
EXPOSE 8080
CMD ["npm", "start"]
