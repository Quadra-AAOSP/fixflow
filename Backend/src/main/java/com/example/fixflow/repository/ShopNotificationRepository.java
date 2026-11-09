package com.example.fixflow.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.fixflow.domain.ShopNotification;

public interface ShopNotificationRepository extends JpaRepository<ShopNotification, Long> {
	Slice<ShopNotification> findByRecipientIdOrderByIdDesc(Long recipientId, Pageable pageable);
}
