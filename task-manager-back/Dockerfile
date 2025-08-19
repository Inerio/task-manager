# --- Build stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

# --- Runtime stage
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
ENV SPRING_PROFILES_ACTIVE=prod
WORKDIR /app
COPY --from=build /workspace/target/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]