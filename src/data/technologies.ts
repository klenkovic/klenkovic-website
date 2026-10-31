export interface Technology {
  name: string;
  logo: string;
  // These black marks use their original artwork on a small light backing.
  backing?: boolean;
}

const tech = (name: string, logo: string, backing = false): Technology => ({ name, logo, backing });

// CV technologies and user-requested additions. Order is visual, not a proficiency ranking.
// Assets and their pinned upstream sources: public/licenses/technology-sources.json.
export const technologyRows = [
  {
    label: 'Languages and development tools',
    items: [
      tech('OpenAI Codex', 'codex', true), tech('ChatGPT', 'chatgpt', true),
      tech('Claude Code', 'claudecode'), tech('Claude', 'claude'),
      tech('JavaScript', 'javascript'), tech('TypeScript', 'typescript'), tech('PHP', 'php'),
      tech('Go', 'go'), tech('Rust', 'rust', true), tech('Python', 'python'),
      tech('C++', 'cplusplus'), tech('Java', 'java'), tech('C#', 'csharp'), tech('Bash', 'bash', true),
      tech('Visual Studio Code', 'vscode'),
    ],
  },
  {
    label: 'Application engineering and collaboration',
    items: [
      tech('React', 'react'), tech('GitHub', 'github', true),
      tech('Node.js', 'nodejs'), tech('Bitbucket', 'bitbucket'), tech('Next.js', 'nextjs', true),
      tech('GraphQL', 'graphql'), tech('Redux', 'redux'), tech('Express.js', 'express', true),
      tech('Phalcon', 'phalcon', true), tech('Angular', 'angular'), tech('.NET', 'dotnetcore'),
      tech('Meteor', 'meteor'), tech('Jira', 'jira'), tech('Confluence', 'confluence'),
    ],
  },
  {
    label: 'Platforms and delivery',
    items: [
      tech('Kubernetes', 'kubernetes'), tech('Docker', 'docker'), tech('Terraform', 'terraform'),
      tech('Ansible', 'ansible', true),
      tech('Argo CD', 'argocd'), tech('GitLab', 'gitlab'), tech('Jenkins', 'jenkins'),
      tech('GNU/Linux', 'linux'), tech('NGINX', 'nginx'), tech('Prometheus', 'prometheus'),
      tech('Grafana', 'grafana'), tech('Grafana Alloy', 'grafana-alloy'), tech('Git', 'git'),
    ],
  },
  {
    label: 'Cloud, data and security',
    items: [
      tech('Amazon Web Services', 'amazonwebservices', true), tech('Microsoft Azure', 'azure'),
      tech('Google Cloud', 'googlecloud'), tech('MySQL', 'mysql'), tech('PostgreSQL', 'postgresql'),
      tech('MongoDB', 'mongodb'), tech('Redis', 'redis'), tech('SQLite', 'sqlite'),
      tech('Microsoft SQL Server', 'microsoftsqlserver'), tech('RabbitMQ', 'rabbitmq'),
      tech('Bitwarden', 'bitwarden'), tech('Passbolt', 'passbolt'),
    ],
  },
  {
    label: 'AWS services',
    items: [
      tech('Amazon Elastic Compute Cloud (EC2)', 'aws-ec2'),
      tech('Amazon Simple Storage Service (S3)', 'aws-s3'),
      tech('Amazon Elastic Kubernetes Service (EKS)', 'aws-eks'),
      tech('AWS Lambda', 'aws-lambda'), tech('Amazon Relational Database Service (RDS)', 'aws-rds'),
      tech('Amazon CloudFront', 'aws-cloudfront'), tech('Amazon API Gateway', 'aws-api-gateway'),
      tech('Amazon CloudWatch', 'aws-cloudwatch'),
      tech('AWS Identity and Access Management (IAM)', 'aws-iam'),
      tech('Amazon Simple Queue Service (SQS)', 'aws-sqs'),
      tech('AWS Global Accelerator', 'aws-global-accelerator'),
    ],
  },
];
