# industrial-iot-dashboard

# Run docker:

    docker-compose up -d sentinel-db

## Start Node-RED:
    
    sudo docker start sentinel-edge

## Stop Node-RED:
    
    sudo docker stop sentinel-edge


## Check if it's running:

    sudo docker ps | grep sentinel-edge


## View logs (if needed):

    sudo docker logs sentinel-edge


## Remove completely (if you need to recreate):

    sudo docker rm -f sentinel-edge

# Run prisma migrations:

        npx prisma migrate dev --name init    

        npx prisma studio -- see prisma interface