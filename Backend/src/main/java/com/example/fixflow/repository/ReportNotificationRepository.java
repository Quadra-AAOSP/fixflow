package com.example.fixflow.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.ReportNotification;

public interface ReportNotificationRepository extends JpaRepository<ReportNotification, Long> {
    Page<ReportNotification> findByRecipientIdOrderByIdDesc(Long recipientId, Pageable pageable);
}
