import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listProjects(companyId: string, opts: { status?: string } = {}) {
    let query = this.supabase.getAdminClient()
      .from('projects')
      .select(`
        *,
        created_by_user:users!projects_created_by_fkey (id, full_name, avatar_url),
        task_counts:project_tasks(status)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (opts.status) query = query.eq('status', opts.status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    return (data || []).map((p: any) => ({
      ...p,
      task_counts: {
        total: p.task_counts?.length || 0,
        todo: p.task_counts?.filter((t: any) => t.status === 'todo').length || 0,
        in_progress: p.task_counts?.filter((t: any) => t.status === 'in_progress').length || 0,
        review: p.task_counts?.filter((t: any) => t.status === 'review').length || 0,
        done: p.task_counts?.filter((t: any) => t.status === 'done').length || 0,
      },
    }));
  }

  async getProject(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('projects')
      .select(`*, created_by_user:users!projects_created_by_fkey (id, full_name)`)
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Project not found');
    return data;
  }

  async createProject(companyId: string, userId: string, dto: {
    name: string;
    description?: string;
    color?: string;
    due_date?: string;
    status?: string;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('projects')
      .insert({ company_id: companyId, created_by: userId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateProject(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('projects')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteProject(companyId: string, id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // Tasks
  async getTasksBoard(companyId: string, projectId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('project_tasks')
      .select(`
        *,
        assigned_user:users!project_tasks_assigned_to_fkey (id, full_name, avatar_url),
        contacts (id, name, phone),
        leads (id, title, stage)
      `)
      .eq('project_id', projectId)
      .eq('company_id', companyId)
      .order('order_position', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    const statuses = ['todo', 'in_progress', 'review', 'done'];
    return statuses.reduce((acc, status) => {
      acc[status] = (data || []).filter((t) => t.status === status);
      return acc;
    }, {} as Record<string, any[]>);
  }

  async createTask(companyId: string, projectId: string, userId: string, dto: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigned_to?: string;
    due_date?: string;
    contact_id?: string;
    lead_id?: string;
  }) {
    const { count } = await this.supabase.getAdminClient()
      .from('project_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', dto.status || 'todo');

    const { data, error } = await this.supabase.getAdminClient()
      .from('project_tasks')
      .insert({
        company_id: companyId,
        project_id: projectId,
        created_by: userId,
        order_position: count || 0,
        ...dto,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateTask(companyId: string, projectId: string, taskId: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('project_tasks')
      .update(dto)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteTask(companyId: string, projectId: string, taskId: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('project_tasks')
      .delete()
      .eq('id', taskId)
      .eq('project_id', projectId)
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }
}
