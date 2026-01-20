FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Set dummy DATABASE_URL for Prisma generate (actual URL comes from Secrets Manager at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
