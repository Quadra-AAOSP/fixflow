package com.example.fixflow.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.web.ApiException;

@Service
public class RoleIntegrityService {

	public void requireTechnician(User user) {
		if (user.getRole() != UserRole.technician) {
			throw new ApiException(
					HttpStatus.BAD_REQUEST.value(),
					"User " + user.getId() + " is not a technician"
			);
		}
	}
}
