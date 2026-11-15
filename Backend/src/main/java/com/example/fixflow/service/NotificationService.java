package com.example.fixflow.service;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ReportNotification;
import com.example.fixflow.domain.ReportNotification.Type;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ReportNotificationRepository;
import com.example.fixflow.repository.TechnicianSkillRepository;
import com.example.fixflow.repository.UserRepository;

/**
 * Single entry point for writing inbox rows, so every workflow step notifies the
 * right people with a consistent shape.
 */
@Service
public class NotificationService {
    private final ReportNotificationRepository rows;
    private final UserRepository users;
    private final TechnicianSkillRepository skills;

    public NotificationService(ReportNotificationRepository rows, UserRepository users,
            TechnicianSkillRepository skills) {
        this.rows = rows;
        this.users = users;
        this.skills = skills;
    }

    /** Notify one recipient about a report (or an account-level event when reportId is null). */
    @Transactional
    public void send(Long recipientId, Type type, Long reportId, Long referenceId) {
        if (recipientId == null) return;
        rows.save(new ReportNotification(recipientId, reportId, referenceId, type, Instant.now()));
    }

    @Transactional
    public void sendEach(Collection<Long> recipientIds, Type type, Long reportId, Long referenceId) {
        Set<Long> unique = new LinkedHashSet<>(recipientIds);
        unique.remove(null);
        if (unique.isEmpty()) return;
        Instant now = Instant.now();
        rows.saveAll(unique.stream()
                .map(id -> new ReportNotification(id, reportId, referenceId, type, now))
                .toList());
    }

    /** Every super admin (platform verification queue, new submissions). */
    @Transactional
    public void toSuperAdmins(Type type, Long referenceId) {
        sendEach(users.findByRoleOrderByLastNameAscFirstNameAsc(UserRole.super_admin).stream()
                .map(User::getId).toList(), type, null, referenceId);
    }

    /** Every admin of one site (contract requests, site-scoped events). */
    @Transactional
    public void toSiteAdmins(Long siteId, Type type, Long referenceId) {
        if (siteId == null) return;
        sendEach(users.findIdsBySiteAndRole(siteId, UserRole.admin), type, null, referenceId);
    }

    /**
     * Technicians whose skills include this category. Falls back to every
     * technician when nobody has the skill on file, so a published job is never
     * silently invisible.
     */
    @Transactional
    public void toTechniciansWithSkill(String category, Type type, Long referenceId) {
        List<Long> recipients = List.of();
        if (category != null && !category.isBlank()) {
            recipients = skills.findByCategoryIgnoreCase(category.trim(), PageRequest.of(0, 500)).stream()
                    .map(skill -> skill.getTechnician().getId())
                    .distinct().toList();
        }
        if (recipients.isEmpty()) {
            recipients = users.findByRoleOrderByLastNameAscFirstNameAsc(UserRole.technician).stream()
                    .map(User::getId).toList();
        }
        sendEach(recipients, type, null, referenceId);
    }
}
