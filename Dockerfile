# Stage 1: Build the Vite production assets
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the remaining files and build the app
COPY . .
RUN npm run build

# Stage 2: Serve the built assets using Nginx
FROM nginx:alpine
# Copy the production build from the builder stage to Nginx's html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
