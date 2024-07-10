# Dockerfile
FROM postgres:13.3-alpine

ENV POSTGRES_USER=user
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_DB=mydatabase
