FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
RUN mkdir -p /app/uploads
ENV PORT=4000
ENV UPLOAD_DIR=/app/uploads
EXPOSE 4000
CMD ["node", "src/index.js"]
