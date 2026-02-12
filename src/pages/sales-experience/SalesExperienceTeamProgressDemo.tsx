import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Users,
  Trophy,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
} from 'lucide-react';

// ── Mock data for marketing screenshots ──────────────────────────────

const MOCK_STAFF = [
  {
    staff_user_id: '1',
    staff_users: { id: '1', display_name: 'Sarah Mitchell', email: 'sarah@agency.com', team_members: { name: 'Sarah Mitchell' } },
    total_lessons: 24, completed_lessons: 24, avg_quiz_score: 94, last_activity: '2026-02-11T14:30:00Z',
  },
  {
    staff_user_id: '2',
    staff_users: { id: '2', display_name: 'James Rodriguez', email: 'james@agency.com', team_members: { name: 'James Rodriguez' } },
    total_lessons: 24, completed_lessons: 21, avg_quiz_score: 87, last_activity: '2026-02-11T09:15:00Z',
  },
  {
    staff_user_id: '3',
    staff_users: { id: '3', display_name: 'Emily Chen', email: 'emily@agency.com', team_members: { name: 'Emily Chen' } },
    total_lessons: 24, completed_lessons: 18, avg_quiz_score: 82, last_activity: '2026-02-10T16:45:00Z',
  },
  {
    staff_user_id: '4',
    staff_users: { id: '4', display_name: 'Marcus Thompson', email: 'marcus@agency.com', team_members: { name: 'Marcus Thompson' } },
    total_lessons: 24, completed_lessons: 14, avg_quiz_score: 76, last_activity: '2026-02-10T11:20:00Z',
  },
  {
    staff_user_id: '5',
    staff_users: { id: '5', display_name: 'Ashley Walker', email: 'ashley@agency.com', team_members: { name: 'Ashley Walker' } },
    total_lessons: 24, completed_lessons: 10, avg_quiz_score: 71, last_activity: '2026-02-09T13:00:00Z',
  },
  {
    staff_user_id: '6',
    staff_users: { id: '6', display_name: 'David Kim', email: 'david@agency.com', team_members: { name: 'David Kim' } },
    total_lessons: 24, completed_lessons: 24, avg_quiz_score: 91, last_activity: '2026-02-11T10:00:00Z',
  },
  {
    staff_user_id: '7',
    staff_users: { id: '7', display_name: 'Rachel Nguyen', email: 'rachel@agency.com', team_members: { name: 'Rachel Nguyen' } },
    total_lessons: 24, completed_lessons: 7, avg_quiz_score: 68, last_activity: '2026-02-08T15:30:00Z',
  },
];

interface DemoQuizAttempt {
  id: string;
  staff_user_id: string;
  lesson_id: string;
  score_percent: number;
  completed_at: string;
  answers_json: Array<{
    question_id: string;
    question: string;
    user_answer: string;
    correct_answer?: string | null;
    is_correct?: boolean;
    is_open_ended?: boolean;
    points?: number;
  }>;
  feedback_ai?: string | null;
  staff_users: { display_name: string };
  sales_experience_lessons: {
    title: string;
    sales_experience_modules: { week_number: number };
  };
}

const MOCK_QUIZZES: DemoQuizAttempt[] = [
  {
    id: 'q1', staff_user_id: '1', lesson_id: 'l1', score_percent: 100,
    completed_at: '2026-02-11T14:30:00Z',
    answers_json: [
      { question_id: 'a1', question: 'What is the primary benefit of needs-based selling vs. product-based selling?', user_answer: 'Needs-based selling builds trust by addressing the customer\'s specific pain points rather than pushing products, leading to higher close rates and better retention.', is_open_ended: true, points: 10 },
      { question_id: 'a2', question: 'Which objection-handling technique uses the "feel, felt, found" framework?', user_answer: 'Empathetic reframing', correct_answer: 'Empathetic reframing', is_correct: true, points: 10 },
      { question_id: 'a3', question: 'What should you do BEFORE presenting a quote to a prospect?', user_answer: 'Confirm their priorities and budget expectations to ensure the recommendation aligns with their needs.', correct_answer: 'Confirm their priorities and budget expectations', is_correct: true, points: 10 },
      { question_id: 'a4', question: 'Name two ways to create urgency without being pushy.', user_answer: 'Highlight upcoming rate changes or policy expiration dates, and reference seasonal risk factors relevant to their coverage gaps.', is_open_ended: true, points: 10 },
    ],
    feedback_ai: 'Excellent work, Sarah! Your understanding of needs-based selling principles is thorough. Your answer on creating urgency was particularly strong — referencing seasonal risk factors shows real-world application of the concepts. Keep up this level of engagement as you move into the advanced negotiation modules.',
    staff_users: { display_name: 'Sarah Mitchell' },
    sales_experience_lessons: { title: 'Advanced Objection Handling', sales_experience_modules: { week_number: 6 } },
  },
  {
    id: 'q2', staff_user_id: '2', lesson_id: 'l2', score_percent: 85,
    completed_at: '2026-02-11T09:15:00Z',
    answers_json: [
      { question_id: 'b1', question: 'What are the three steps of the consultative close?', user_answer: 'Summarize needs, present tailored solution, ask for commitment', correct_answer: 'Summarize needs, present tailored solution, ask for commitment', is_correct: true, points: 10 },
      { question_id: 'b2', question: 'When a prospect says "I need to think about it," what is the recommended response?', user_answer: 'Ask them what specific concerns they still have', correct_answer: 'Acknowledge, then isolate the specific concern', is_correct: false, points: 0 },
      { question_id: 'b3', question: 'Describe the "value stack" technique.', user_answer: 'Building perceived value by layering benefits on top of each other before revealing the price, so the prospect sees the total value exceeds the cost.', is_open_ended: true, points: 8 },
    ],
    feedback_ai: 'Great progress, James! You nailed the consultative close steps. On the "think about it" objection — remember to acknowledge first before isolating. This prevents the prospect from feeling rushed. Your value stack description was solid.',
    staff_users: { display_name: 'James Rodriguez' },
    sales_experience_lessons: { title: 'Closing Techniques', sales_experience_modules: { week_number: 5 } },
  },
  {
    id: 'q3', staff_user_id: '6', lesson_id: 'l3', score_percent: 95,
    completed_at: '2026-02-11T10:00:00Z',
    answers_json: [],
    feedback_ai: null,
    staff_users: { display_name: 'David Kim' },
    sales_experience_lessons: { title: 'Building Long-Term Client Relationships', sales_experience_modules: { week_number: 7 } },
  },
  {
    id: 'q4', staff_user_id: '3', lesson_id: 'l4', score_percent: 80,
    completed_at: '2026-02-10T16:45:00Z',
    answers_json: [],
    feedback_ai: null,
    staff_users: { display_name: 'Emily Chen' },
    sales_experience_lessons: { title: 'Cross-Selling & Bundling Strategies', sales_experience_modules: { week_number: 4 } },
  },
  {
    id: 'q5', staff_user_id: '4', lesson_id: 'l5', score_percent: 72,
    completed_at: '2026-02-10T11:20:00Z',
    answers_json: [],
    feedback_ai: null,
    staff_users: { display_name: 'Marcus Thompson' },
    sales_experience_lessons: { title: 'Mastering the Discovery Call', sales_experience_modules: { week_number: 3 } },
  },
  {
    id: 'q6', staff_user_id: '5', lesson_id: 'l6', score_percent: 78,
    completed_at: '2026-02-09T13:00:00Z',
    answers_json: [],
    feedback_ai: null,
    staff_users: { display_name: 'Ashley Walker' },
    sales_experience_lessons: { title: 'Understanding Policy Types', sales_experience_modules: { week_number: 2 } },
  },
  {
    id: 'q7', staff_user_id: '7', lesson_id: 'l7', score_percent: 65,
    completed_at: '2026-02-08T15:30:00Z',
    answers_json: [],
    feedback_ai: null,
    staff_users: { display_name: 'Rachel Nguyen' },
    sales_experience_lessons: { title: 'First Impressions & Rapport', sales_experience_modules: { week_number: 1 } },
  },
];

// ── Component ────────────────────────────────────────────────────────

export default function SalesExperienceTeamProgressDemo() {
  const [selectedQuiz, setSelectedQuiz] = useState<DemoQuizAttempt | null>(MOCK_QUIZZES[0]);

  const staffProgress = MOCK_STAFF;
  const recentQuizzes = MOCK_QUIZZES;

  // Calculate team stats
  const totalStaff = staffProgress.length;
  const avgCompletion = Math.round(
    staffProgress.reduce((sum, s) => sum + (s.completed_lessons / s.total_lessons) * 100, 0) / totalStaff
  );
  const staffWithScores = staffProgress.filter((s) => s.avg_quiz_score !== null);
  const avgQuizScore = Math.round(
    staffWithScores.reduce((sum, s) => sum + (s.avg_quiz_score || 0), 0) / staffWithScores.length
  );
  const completedCount = staffProgress.filter((s) => s.completed_lessons === s.total_lessons).length;

  const getInitials = (staff: (typeof MOCK_STAFF)[0]['staff_users']) => {
    const name = staff.display_name || staff.team_members?.name || staff.email || 'Unknown';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDisplayName = (staff: (typeof MOCK_STAFF)[0]['staff_users']) => {
    return staff.display_name || staff.team_members?.name || staff.email || 'Unknown Staff';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Team Quiz Results</h1>
        <p className="text-muted-foreground">
          Track your team's progress through the 8-Week Sales Experience training
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{totalStaff}</span>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{avgCompletion}%</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Quiz Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{avgQuizScore}%</span>
              <Target className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fully Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{completedCount}</span>
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Progress Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual Progress
          </CardTitle>
          <CardDescription>
            Lesson completion and quiz scores by team member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Avg. Quiz</TableHead>
                <TableHead className="text-right">Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffProgress.map((staff) => {
                const completionPct = Math.round(
                  (staff.completed_lessons / staff.total_lessons) * 100
                );
                return (
                  <TableRow key={staff.staff_user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(staff.staff_users)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {getDisplayName(staff.staff_users)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <Progress value={completionPct} className="h-2" />
                        <span className="text-sm text-muted-foreground w-12">
                          {completionPct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={staff.completed_lessons === staff.total_lessons ? 'default' : 'outline'}>
                        {staff.completed_lessons}/{staff.total_lessons}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.avg_quiz_score !== null ? (
                        <span className={`font-semibold ${getScoreColor(staff.avg_quiz_score)}`}>
                          {Math.round(staff.avg_quiz_score)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {staff.last_activity
                        ? new Date(staff.last_activity).toLocaleDateString()
                        : '--'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Quiz Attempts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Recent Quiz Completions
          </CardTitle>
          <CardDescription>Latest quiz attempts from your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {quiz.staff_users?.display_name
                        ?.split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {quiz.staff_users?.display_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Week{' '}
                      {quiz.sales_experience_lessons?.sales_experience_modules?.week_number || '?'}{' '}
                      - {quiz.sales_experience_lessons?.title || 'Unknown Lesson'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${getScoreColor(quiz.score_percent)}`}>
                    {quiz.score_percent}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(quiz.completed_at)}
                  </span>
                  <Button
                    size="sm"
                    variant={selectedQuiz?.id === quiz.id ? 'default' : 'outline'}
                    onClick={() => setSelectedQuiz(selectedQuiz?.id === quiz.id ? null : quiz)}
                  >
                    {selectedQuiz?.id === quiz.id ? 'Hide' : 'View Responses'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedQuiz && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">
              Quiz Responses
            </CardTitle>
            <CardDescription>
              {selectedQuiz.staff_users?.display_name || 'Unknown'} • Week{' '}
              {selectedQuiz.sales_experience_lessons?.sales_experience_modules?.week_number || '?'} •{' '}
              {selectedQuiz.sales_experience_lessons?.title || 'Unknown Lesson'} •{' '}
              {formatDate(selectedQuiz.completed_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className={`text-2xl font-bold ${getScoreColor(selectedQuiz.score_percent)}`}>
                {selectedQuiz.score_percent}%
              </span>
              {selectedQuiz.feedback_ai ? (
                <span className="text-sm text-muted-foreground">
                  AI Feedback available below
                </span>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedQuiz(null)}
              >
                Close
              </Button>
            </div>

            {selectedQuiz.answers_json && selectedQuiz.answers_json.length > 0 ? (
              <div className="space-y-3">
                {selectedQuiz.answers_json.map((answer, index) => (
                  <div key={answer.question_id || index} className="p-3 rounded-lg border">
                    <p className="font-medium mb-2">
                      {index + 1}. {answer.question}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Answer:</span>{' '}
                      {answer.user_answer || '--'}
                    </p>
                    {answer.correct_answer ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Correct:</span>{' '}
                        {answer.correct_answer}
                      </p>
                    ) : null}
                    {typeof answer.is_correct === 'boolean' ? (
                      <p className="text-sm">
                        <span className="font-semibold">Result:</span>{' '}
                        <span className={answer.is_correct ? 'text-green-600' : 'text-red-600'}>
                          {answer.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No responses recorded.</p>
            )}

            {selectedQuiz.feedback_ai ? (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-semibold mb-1">AI Feedback</p>
                <p className="text-sm whitespace-pre-wrap">{selectedQuiz.feedback_ai}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
