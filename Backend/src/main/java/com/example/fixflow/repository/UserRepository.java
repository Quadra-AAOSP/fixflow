package com.example.fixflow.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCase(String email);

	boolean existsByRole(UserRole role);

	@Query("select u from User u left join fetch u.site where u.id = :id")
	Optional<User> findWithSiteById(@Param("id") Long id);
}
