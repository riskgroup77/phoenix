"""
Minimal load test: locust -f locustfile.py --host=https://api.example.com
Health va asosiy ommaviy endpointlar (autentifikatsiyasiz).
"""

from locust import HttpUser, between, task


class HealthUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def health(self):
        self.client.get('/health/')

    @task(1)
    def health_ready(self):
        self.client.get('/health/ready/')

    @task(1)
    def metrics(self):
        self.client.get('/metrics/')
