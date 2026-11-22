// Pipeline do frontend (taxify-ui): build Angular -> imagem Docker -> push no Docker Hub.
// Requer no Jenkins: plugins Pipeline, Git, Docker Pipeline e Credentials Binding;
// credencial "dockerhub" (usuário + access token); agente com Docker.
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    parameters {
        booleanParam(name: 'PUSH_IMAGE', defaultValue: true, description: 'Enviar a imagem para o Docker Hub')
    }

    environment {
        IMAGE = 'thiagoocms/taxify-ui'
        TAG = "${new Date().format('yyyy.MM.dd')}.${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Angular') {
            steps {
                script {
                    // Valida o build antes da imagem (falha rápido, com log mais legível).
                    docker.image('node:20-alpine').inside('-v taxify-npm:/root/.npm -u root') {
                        sh 'npm ci --legacy-peer-deps && npm run build -- --configuration production'
                    }
                }
            }
        }

        stage('Build da imagem') {
            steps {
                sh 'docker build -t $IMAGE:$TAG -t $IMAGE:latest .'
            }
        }

        stage('Push Docker Hub') {
            when {
                allOf {
                    expression { params.PUSH_IMAGE }
                    anyOf { branch 'master'; expression { env.BRANCH_NAME == null } }
                }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub',
                        usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_TOKEN')]) {
                    sh '''
                        echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push $IMAGE:$TAG
                        docker push $IMAGE:latest
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Imagem publicada: ${IMAGE}:${TAG}"
        }
        always {
            sh 'docker logout || true'
        }
    }
}
