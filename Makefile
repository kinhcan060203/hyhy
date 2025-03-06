build:
	@docker compose -f deployment/docker-compose.yaml build

run:
	@docker compose -f deployment/docker-compose.yaml up -d

stop:
	@docker compose -f deployment/docker-compose.yaml down

run-rebuild:
	@docker compose -f deployment/docker-compose.yaml up --build -d