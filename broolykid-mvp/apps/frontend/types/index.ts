// User types
export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  role: 'member' | 'admin' | 'moderator';
  createdAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'email'>;
}

// Proposal types
export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposerId: string;
  proposer?: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  status: 'active' | 'passed' | 'rejected' | 'expired';
  votesFor: number;
  votesAgainst: number;
  createdAt: Date;
  endsAt: Date;
}

export interface CreateProposalRequest {
  title: string;
  description: string;
  endsAt: string; // ISO date string
}

export interface VoteRequest {
  voteOption: 'for' | 'against';
}

// Course types
export interface Course {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  durationMinutes?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  createdAt: Date;
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  durationMinutes?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number; // 0-100
  completedAt?: Date;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}



