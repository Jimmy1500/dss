FROM postgres:alpine

ENV POSTGRES_USER postgres
ENV POSTGRES_PASSWORD postgres
ENV POSTGRES_DB m3 

EXPOSE 5432

COPY ./db/flyway/local.sql docker-entrypoint-initdb.d/local.sql