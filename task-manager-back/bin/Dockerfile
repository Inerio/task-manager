# syntax=docker/dockerfile:1

ARG JAVA_VERSION=21

# ---------- Build stage ----------
FROM maven:3.9-eclipse-temurin-${JAVA_VERSION} AS build
WORKDIR /src
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

# ---------- Runtime stage ----------
FROM eclipse-temurin:${JAVA_VERSION}-jre
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom" \
    SPRING_PROFILES_ACTIVE=prod \
    APP_UPLOAD_DIR=/app/uploads
WORKDIR /app

# Non-root user
RUN useradd -u 10001 -m appuser
COPY --from=build /src/target/*.jar /app/app.jar

VOLUME ["/app/uploads"]
EXPOSE 8080
USER appuser
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
