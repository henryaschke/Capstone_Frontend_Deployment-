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

# Set the PORT environment variable to 8080 (Cloud Run expects this)
ENV PORT=8080

# Update the Nginx configuration to listen on port 8080 instead of 80
RUN sed -i 's/listen\s\+80;/listen 8080;/g' /etc/nginx/conf.d/default.conf

# Copy the production build from the builder stage to Nginx's html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080
EXPOSE 8080

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
